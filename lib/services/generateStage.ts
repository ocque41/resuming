import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError,
  hasCompletedStage
} from './progressiveOptimization';
import { MistralRAGService } from '@/lib/utils/mistralRagService';
import { processCustomPromptWithGPT4o } from '@/lib/services/openai.service';

/**
 * Runs the generate stage of the CV optimization process
 */
export async function runGenerateStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  documentFormat: string = 'markdown'
): Promise<OptimizationState> {
  logger.info(`Starting generate stage for CV ${cvId}`);
  
  // Initialize RAG service
  const ragService = new MistralRAGService();
  
  // Update state to indicate generation has started
  let state = updateStage(currentState, OptimizationStage.GENERATE_STARTED);
  
  try {
    // Generate the optimized document
    state = await generateDocumentStep(userId, cvId, jobDescription, ragService, state, documentFormat);
    
    // Mark generation as completed
    state = updateStage(state, OptimizationStage.GENERATE_COMPLETED);
    
    logger.info(`Completed generate stage for CV ${cvId}`);
    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in generate stage for CV ${cvId}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generates the optimized document
 */
async function generateDocumentStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState,
  documentFormat: string
): Promise<OptimizationState> {
  logger.info(`Generating optimized document for CV ${cvId} in ${documentFormat} format`);
  
  try {
    // Collect all optimized sections
    const optimizedSections = {
      profile: currentState.results.optimizedProfile || '',
      experience: currentState.results.optimizedExperience || [],
      skills: currentState.results.optimizedSkills || [],
      education: currentState.results.optimizedEducation || []
    };
    
    // Get original sections for any that weren't optimized
    const originalSections = currentState.results.sections || [];
    
    // Generate the document using the OpenAI service since MistralRAG doesn't have this method
    // We'll use a simplified approach for now
    let formattedDocument = '';
    
    // Add profile section
    if (optimizedSections.profile) {
      formattedDocument += `# Professional Profile\n\n${optimizedSections.profile}\n\n`;
    }
    
    // Add experience section
    if (optimizedSections.experience && optimizedSections.experience.length > 0) {
      formattedDocument += `# Professional Experience\n\n`;
      optimizedSections.experience.forEach(exp => {
        formattedDocument += `${exp}\n\n`;
      });
    }
    
    // Add skills section
    if (optimizedSections.skills && optimizedSections.skills.length > 0) {
      formattedDocument += `# Skills\n\n`;
      optimizedSections.skills.forEach(skill => {
        formattedDocument += `- ${skill}\n`;
      });
      formattedDocument += '\n';
    }
    
    // Add education section
    if (optimizedSections.education && optimizedSections.education.length > 0) {
      formattedDocument += `# Education\n\n`;
      optimizedSections.education.forEach(edu => {
        formattedDocument += `${edu}\n\n`;
      });
    }
    
    // Add any original sections that weren't optimized
    const optimizedSectionNames = ['profile', 'experience', 'skills', 'education'];
    originalSections.forEach(section => {
      const sectionNameLower = section.name.toLowerCase();
      const isAlreadyIncluded = optimizedSectionNames.some(name => 
        sectionNameLower.includes(name)
      );
      
      if (!isAlreadyIncluded) {
        formattedDocument += `# ${section.name}\n\n${section.content}\n\n`;
      }
    });
    
    // Calculate a simple match score based on keyword matching
    const matchScore = calculateSimpleMatchScore(formattedDocument, jobDescription);
    
    // Generate simple recommendations
    const recommendations = generateSimpleRecommendations(
      formattedDocument, 
      jobDescription,
      currentState.results.keyRequirements || []
    );
    
    // Update the state with the generated document
    const updatedState = updateStage(currentState, OptimizationStage.GENERATE_COMPLETED);
    updatedState.results.formattedDocument = formattedDocument;
    updatedState.results.format = documentFormat;
    updatedState.results.matchScore = matchScore;
    updatedState.results.recommendations = recommendations;
    
    // Also set the optimizedContent for backward compatibility
    updatedState.results.optimizedContent = formattedDocument;
    
    logger.info(`Successfully generated optimized document for CV ${cvId} with match score ${matchScore}`);
    return updatedState;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error generating document for CV ${cvId}: ${errorMessage}`);
    
    // Return the current state without updating
    return currentState;
  }
}

/**
 * Calculate a simple match score based on keyword matching
 */
function calculateSimpleMatchScore(cvText: string, jobDescription: string): number {
  // Extract keywords from job description
  const jobKeywords = extractKeywords(jobDescription);
  
  // Count how many keywords are in the CV
  let matchCount = 0;
  jobKeywords.forEach(keyword => {
    if (cvText.toLowerCase().includes(keyword.toLowerCase())) {
      matchCount++;
    }
  });
  
  // Calculate score as percentage of matched keywords
  const score = jobKeywords.length > 0 ? matchCount / jobKeywords.length : 0;
  
  // Scale to 0-1 range and ensure it's between 0 and 1
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - split by spaces and filter out common words
  const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as'];
  const words = text.toLowerCase().split(/\W+/);
  
  // Filter out common words and short words
  const keywords = words.filter(word => 
    word.length > 3 && !commonWords.includes(word)
  );
  
  // Remove duplicates
  return [...new Set(keywords)];
}

/**
 * Generate simple recommendations based on missing keywords
 */
function generateSimpleRecommendations(cvText: string, jobDescription: string, keyRequirements: string[]): string[] {
  const recommendations: string[] = [];
  
  // Check for missing key requirements
  const missingRequirements = keyRequirements.filter(req => 
    !cvText.toLowerCase().includes(req.toLowerCase())
  );
  
  if (missingRequirements.length > 0) {
    recommendations.push(`Consider adding these key requirements: ${missingRequirements.join(', ')}`);
  }
  
  // Check for job description keywords
  const jobKeywords = extractKeywords(jobDescription);
  const missingKeywords = jobKeywords.filter(keyword => 
    !cvText.toLowerCase().includes(keyword.toLowerCase())
  ).slice(0, 10); // Limit to top 10 missing keywords
  
  if (missingKeywords.length > 0) {
    recommendations.push(`Include these relevant keywords: ${missingKeywords.join(', ')}`);
  }
  
  // Add general recommendations
  recommendations.push('Ensure your CV is concise and focused on achievements rather than just responsibilities');
  recommendations.push('Quantify your achievements with metrics where possible');
  recommendations.push('Tailor your CV to highlight experience most relevant to the job description');
  
  return recommendations;
}

/**
 * Generate a formatted document from the optimized content
 */
async function generateFormattedDocument(
  optimizedContent: string,
  format: string,
  matchScore: number,
  recommendations: string[]
): Promise<string> {
  try {
    logger.info(`Generating ${format} document`);
    
    // Format the match score as a percentage
    const matchScorePercent = Math.round(matchScore * 100);
    
    // Generate the document based on the requested format
    switch (format.toLowerCase()) {
      case 'markdown':
        return generateMarkdownDocument(optimizedContent, matchScorePercent, recommendations);
      case 'html':
        return generateHTMLDocument(optimizedContent, matchScorePercent, recommendations);
      case 'text':
      default:
        return generateTextDocument(optimizedContent, matchScorePercent, recommendations);
    }
  } catch (error) {
    logger.error(`Error generating formatted document: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to generate formatted document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a markdown document
 */
async function generateMarkdownDocument(
  optimizedContent: string,
  matchScore: number,
  recommendations: string[]
): Promise<string> {
  try {
    // Use OpenAI to format the document as markdown
    const prompt = `
    I need to format this CV content as a professional Markdown document.
    
    CV Content:
    ${optimizedContent}
    
    Match Score: ${matchScore}%
    
    Recommendations:
    ${recommendations.join('\n')}
    
    Please format this as a professional Markdown document with:
    1. Clear section headings (##)
    2. Proper formatting for lists, bold, and italics
    3. A professional layout
    4. Include the match score and recommendations at the end
    
    Return ONLY the formatted Markdown, no explanations.
    `;
    
    const response = await processCustomPromptWithGPT4o(prompt, 0.3);
    return response.trim();
  } catch (error) {
    logger.error(`Error generating markdown document: ${error instanceof Error ? error.message : String(error)}`);
    
    // Create a basic markdown document as fallback
    return `# Optimized CV

${optimizedContent.split('\n\n').map(section => {
  const lines = section.split('\n');
  if (lines.length > 0) {
    return `## ${lines[0]}\n\n${lines.slice(1).join('\n')}`;
  }
  return section;
}).join('\n\n')}

## Match Score

${matchScore}% match with the job description

## Recommendations

${recommendations.map(rec => `- ${rec}`).join('\n')}
`;
  }
}

/**
 * Generate an HTML document
 */
async function generateHTMLDocument(
  optimizedContent: string,
  matchScore: number,
  recommendations: string[]
): Promise<string> {
  try {
    // Use OpenAI to format the document as HTML
    const prompt = `
    I need to format this CV content as a professional HTML document.
    
    CV Content:
    ${optimizedContent}
    
    Match Score: ${matchScore}%
    
    Recommendations:
    ${recommendations.join('\n')}
    
    Please format this as a professional HTML document with:
    1. Clean, modern styling
    2. Proper HTML structure with sections
    3. A professional layout
    4. Include the match score and recommendations at the end
    
    Return ONLY the formatted HTML, no explanations.
    `;
    
    const response = await processCustomPromptWithGPT4o(prompt, 0.3);
    return response.trim();
  } catch (error) {
    logger.error(`Error generating HTML document: ${error instanceof Error ? error.message : String(error)}`);
    
    // Create a basic HTML document as fallback
    return `<!DOCTYPE html>
<html>
<head>
  <title>Optimized CV</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .match-score { background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
    .recommendations { background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
    .recommendations ul { margin-top: 5px; }
  </style>
</head>
<body>
  <h1>Optimized CV</h1>
  
  ${optimizedContent.split('\n\n').map(section => {
    const lines = section.split('\n');
    if (lines.length > 0) {
      return `<h2>${lines[0]}</h2>
  <div>${lines.slice(1).join('<br>')}</div>`;
    }
    return `<div>${section}</div>`;
  }).join('\n\n')}
  
  <h2>Match Score</h2>
  <div class="match-score">
    <p>${matchScore}% match with the job description</p>
  </div>
  
  <h2>Recommendations</h2>
  <div class="recommendations">
    <ul>
      ${recommendations.map(rec => `<li>${rec}</li>`).join('\n      ')}
    </ul>
  </div>
</body>
</html>`;
  }
}

/**
 * Generate a plain text document
 */
async function generateTextDocument(
  optimizedContent: string,
  matchScore: number,
  recommendations: string[]
): Promise<string> {
  // For plain text, we can just use the optimized content with minimal formatting
  const document = `OPTIMIZED CV

${optimizedContent}

MATCH SCORE
${matchScore}% match with the job description

RECOMMENDATIONS
${recommendations.map(rec => `- ${rec}`).join('\n')}
`;

  return document;
} 