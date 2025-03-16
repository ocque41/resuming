import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError,
  hasCompletedStage
} from './progressiveOptimization';
import { processCustomPromptWithGPT4o, isOpenAIAvailable } from '@/lib/services/openai.service';

/**
 * Runs the generate stage of the CV optimization process
 */
export async function runGenerateStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  documentFormat: string = 'markdown',
  options: { aiService?: 'auto' | 'openai' } = {}
): Promise<OptimizationState> {
  logger.info(`Starting generate stage for CV ${cvId}`);
  
  // Check if OpenAI is available
  const openaiAvailable = await isOpenAIAvailable();
  if (!openaiAvailable) {
    logger.error('OpenAI service is not available');
    return recordOptimizationError(
      userId,
      cvId,
      jobDescription,
      'OpenAI service is not available',
      OptimizationStage.GENERATE_STARTED
    );
  }
  
  // Update state to indicate generation has started
  let state = updateStage(currentState, OptimizationStage.GENERATE_STARTED);
  
  try {
    // Generate the optimized document
    state = await generateDocumentWithOpenAI(userId, cvId, jobDescription, state, documentFormat);
    
    // Mark generation as completed
    state = updateStage(state, OptimizationStage.GENERATE_COMPLETED);
    
    logger.info(`Completed generate stage for CV ${cvId}`);
    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in generate stage for CV ${cvId}: ${errorMessage}`);
    
    return recordOptimizationError(
      userId,
      cvId,
      jobDescription,
      errorMessage,
      OptimizationStage.GENERATE_STARTED
    );
  }
}

/**
 * Generates the optimized document using OpenAI
 */
async function generateDocumentWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  currentState: OptimizationState,
  documentFormat: string
): Promise<OptimizationState> {
  logger.info(`Generating document for CV ${cvId} in ${documentFormat} format`);
  
  try {
    // Check if we have optimized content
    if (!currentState.results.optimizedContent) {
      throw new Error('No optimized content available for document generation');
    }
    
    // Format the document based on the requested format
    let formattedDocument = '';
    
    if (documentFormat === 'markdown') {
      // For markdown, we can use the optimized content directly
      formattedDocument = currentState.results.optimizedContent;
    } else {
      // For other formats, we need to use OpenAI to format the content
      const prompt = `
        Format the following CV content into a professional ${documentFormat} document:
        
        ${currentState.results.optimizedContent}
        
        Return only the formatted content without any explanations.
      `;
      
      const result = await processCustomPromptWithGPT4o(prompt);
      formattedDocument = result.trim();
    }
    
    // Update the state with the formatted document
    return {
      ...currentState,
      results: {
        ...currentState.results,
        formattedDocument,
        format: documentFormat
      },
      progress: Math.min(100, currentState.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error(`Error generating document: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
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