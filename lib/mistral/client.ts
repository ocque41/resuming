/**
 * Mistral AI Client utility
 * This module provides functions to interact with the Mistral AI API for document analysis
 */

import axios from 'axios';
import { logger } from '@/lib/logger';

// Mistral API configuration
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_AGENT_ID = process.env.MISTRAL_AGENT_ID;
const MISTRAL_API_BASE_URL = 'https://api.mistral.ai/v1';

// Error handling wrapper
const handleMistralError = (error: any): Error => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    
    logger.error(`Mistral API error (${status}): ${JSON.stringify(data)}`);
    
    if (status === 401) {
      return new Error('Authentication failed. Check your Mistral API key.');
    } else if (status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else {
      return new Error(`Mistral API error: ${data?.error?.message || error.message}`);
    }
  }
  
  logger.error(`Unexpected Mistral error: ${error}`);
  return error instanceof Error ? error : new Error(String(error));
};

/**
 * Analyzes a document using Mistral AI Agent
 * 
 * @param documentContent The document content (text)
 * @param documentInfo Information about the document (filename, type, etc)
 * @param analysisType Type of analysis to perform (general, cv, presentation, etc)
 * @returns Analysis results from Mistral AI
 */
export async function analyzeMistralAgent(
  documentContent: string,
  documentInfo: {
    filename: string;
    fileType: string;
    fileSize: number;
  },
  analysisType: 'general' | 'cv' | 'presentation' | 'spreadsheet' | 'report' | string = 'general'
) {
  try {
    if (!MISTRAL_API_KEY || !MISTRAL_AGENT_ID) {
      throw new Error('Mistral API credentials are not configured');
    }
    
    // Set up the agent settings
    const agentSettings = getAnalysisSettings(analysisType);
    
    // Create the prompt for document analysis
    const promptText = `
      You are a professional document analyzer with expertise in all types of business and personal documents.
      Your task is to analyze the following document and provide detailed insights.
      
      Document Information:
      - Filename: ${documentInfo.filename}
      - File Type: ${documentInfo.fileType}
      - File Size: ${(documentInfo.fileSize / 1024 / 1024).toFixed(2)} MB
      
      Document Content:
      ${documentContent.substring(0, 50000)} ${documentContent.length > 50000 ? '... [content truncated due to length]' : ''}
      
      ${agentSettings.instructions}
      
      Provide your analysis in the following JSON format:
      {
        "documentType": "The detected document type (CV, presentation, spreadsheet, report, etc.)",
        "summary": "A concise summary of the document",
        "keyPoints": ["Array of key points extracted from the document"],
        "analysis": {
          "structure": "Analysis of document structure",
          "content": "Analysis of document content",
          "quality": "Assessment of document quality"
        },
        "recommendations": ["Array of specific recommendations for improvement"],
        "metadata": {
          "confidenceScore": "A number between 0-100 indicating confidence in analysis",
          "detectedLanguage": "The primary language of the document",
          "keyTopics": ["Array of key topics detected"]
        }
      }
      
      Return only valid JSON without any other text, explanations, or comments.
    `;

    // Make the API call to Mistral AI Agent
    const apiResponse = await axios.post(
      `${MISTRAL_API_BASE_URL}/agent/${MISTRAL_AGENT_ID}/chat`,
      {
        messages: [
          { role: 'user', content: promptText }
        ],
        temperature: 0.2, // Lower temperature for more consistent results
        max_tokens: 4096, // Adjust based on expected response length
        safe_mode: false, // Allow more flexibility in responses
        tools: [
          {
            id: "document_analyzer",
            type: "function",
            function: {
              name: "analyze_document",
              description: "Analyze document content and provide structured insights",
              parameters: {
                type: "object",
                properties: {
                  documentType: {
                    type: "string",
                    description: "The detected document type (CV, presentation, spreadsheet, report, etc.)"
                  },
                  summary: {
                    type: "string",
                    description: "A concise summary of the document"
                  },
                  keyPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of key points extracted from the document"
                  },
                  analysis: {
                    type: "object",
                    properties: {
                      structure: { type: "string" },
                      content: { type: "string" },
                      quality: { type: "string" }
                    }
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of specific recommendations for improvement"
                  },
                  metadata: {
                    type: "object",
                    properties: {
                      confidenceScore: { type: "number" },
                      detectedLanguage: { type: "string" },
                      keyTopics: { type: "array", items: { type: "string" } }
                    }
                  }
                },
                required: ["documentType", "summary", "keyPoints", "analysis", "recommendations"]
              }
            }
          }
        ],
        tool_choice: {
          type: "function",
          function: {
            name: "analyze_document"
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = apiResponse.data;
    logger.info(`Mistral analysis completed for ${documentInfo.filename}`);
    
    // Extract the analysis results from the tool call
    const toolCalls = result.choices[0]?.message?.tool_calls || [];
    if (toolCalls.length > 0 && toolCalls[0].function?.name === 'analyze_document') {
      try {
        return JSON.parse(toolCalls[0].function.arguments);
      } catch (parseError) {
        logger.error(`Error parsing Mistral tool response: ${parseError}`);
        throw new Error('Failed to parse analysis results');
      }
    }
    
    // Fallback if tool call format is not as expected
    const responseContent = result.choices[0]?.message?.content || '';
    try {
      // Try to extract JSON from the response content
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      logger.error(`Error parsing Mistral response content: ${parseError}`);
    }
    
    throw new Error('Failed to extract analysis results from Mistral response');
  } catch (error) {
    throw handleMistralError(error);
  }
}

/**
 * Get analysis settings based on analysis type
 */
function getAnalysisSettings(analysisType: string) {
  const settings = {
    instructions: '',
    detailLevel: 'high'
  };
  
  switch (analysisType) {
    case 'cv':
      settings.instructions = `
        Focus on analyzing this CV/resume. Determine its effectiveness for job applications.
        Identify the candidate's key qualifications, skills, and experience.
        Assess the CV's structure, clarity, and professional presentation.
        Provide recommendations for improving the CV's impact and ATS compatibility.
        Identify any missing important sections or information.
      `;
      break;
      
    case 'presentation':
      settings.instructions = `
        Analyze this presentation document. Determine its clarity, structure, and persuasiveness.
        Identify the main topic and purpose of the presentation.
        Assess the quality of visual elements, flow, and narrative structure.
        Evaluate whether it effectively communicates its intended message.
        Provide recommendations for improving presentation effectiveness.
      `;
      break;
      
    case 'spreadsheet':
      settings.instructions = `
        Analyze this spreadsheet data. Identify the type of data and its purpose.
        Assess data organization, calculations, and formatting.
        Evaluate data quality, completeness, and any anomalies.
        Determine if there are opportunities for better visualization or analysis.
        Provide recommendations for improving data presentation and insights.
      `;
      break;
      
    case 'report':
      settings.instructions = `
        Analyze this report document. Identify its purpose, audience, and key findings.
        Assess the report's structure, clarity, and data presentation.
        Evaluate the strength of arguments, evidence, and conclusions.
        Identify gaps in information or analysis.
        Provide recommendations for improving report effectiveness and impact.
      `;
      break;
      
    default: // general analysis
      settings.instructions = `
        First, determine what type of document this is (CV, presentation, spreadsheet, report, etc.).
        Then analyze the document based on its detected type.
        Identify the document's purpose, key content, and target audience.
        Assess its structure, clarity, and effectiveness for its intended purpose.
        Provide specific recommendations for improving the document.
        If this is a specialized document type, include domain-specific insights.
      `;
  }
  
  return settings;
}

/**
 * Generate a follow-up question based on initial analysis results
 */
export async function generateFollowupQuestion(
  initialAnalysis: any,
  documentInfo: {
    filename: string;
    fileType: string;
  }
) {
  try {
    if (!MISTRAL_API_KEY) {
      throw new Error('Mistral API credentials are not configured');
    }
    
    const promptText = `
      Based on the initial analysis of the document "${documentInfo.filename}" (${documentInfo.fileType}),
      generate one insightful follow-up question that would help deepen the analysis.
      
      Initial analysis:
      ${JSON.stringify(initialAnalysis, null, 2)}
      
      The follow-up question should:
      1. Focus on an important aspect that could benefit from deeper analysis
      2. Be specific and actionable
      3. Help uncover additional insights or recommendations
      
      Return only the follow-up question without additional explanations.
    `;
    
    const apiResponse = await axios.post(
      `${MISTRAL_API_BASE_URL}/chat/completions`,
      {
        model: 'mistral-large-latest',
        messages: [
          { role: 'user', content: promptText }
        ],
        temperature: 0.3,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return apiResponse.data.choices[0]?.message?.content || 'No follow-up question generated';
  } catch (error) {
    logger.error(`Error generating follow-up question: ${error}`);
    return 'Could not generate follow-up question.';
  }
}

export default {
  analyzeMistralAgent,
  generateFollowupQuestion
}; 