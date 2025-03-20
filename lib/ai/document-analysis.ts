import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Main function to analyze a document using AI
 * @param documentText The raw text content of the document
 * @param fileName The name of the document file
 * @returns Structured analysis result
 */
export async function analyzeDocumentWithAI(documentText: string, fileName: string): Promise<any> {
  try {
    console.log(`Starting AI analysis for document: ${fileName}`);
    
    // Run different analysis tasks in parallel for efficiency
    const [
      contentAnalysis,
      sentimentAnalysis,
      keyInformation,
      summarization
    ] = await Promise.all([
      generateContentAnalysis(documentText),
      generateSentimentAnalysis(documentText),
      extractKeyInformation(documentText),
      generateSummary(documentText)
    ]);
    
    // Combine all analyses into a single structured result
    const result = {
      fileName,
      analysisTimestamp: new Date().toISOString(),
      contentAnalysis,
      sentimentAnalysis,
      keyInformation,
      summary: summarization
    };
    
    console.log(`Completed AI analysis for document: ${fileName}`);
    return result;
  } catch (error) {
    console.error('Error in AI document analysis:', error);
    throw new Error(`Failed to analyze document with AI: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyzes the content structure and keywords of a document
 */
async function generateContentAnalysis(text: string): Promise<any> {
  const prompt = `
    Analyze this document text and provide:
    1. Content distribution - what percentage of the document is dedicated to different sections 
       (e.g., Professional Experience, Education, Skills, etc.)
    2. Top 10 most important keywords with their relative importance score (1-10)
    
    Respond with only valid JSON in this exact format:
    {
      "contentDistribution": [
        {"name": "Category name", "value": percentage_number}
      ],
      "topKeywords": [
        {"text": "keyword", "value": importance_score_number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)} // Limit text length for token constraints
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing content analysis:', error);
    return {
      contentDistribution: [
        { name: "Other", value: 100 }
      ],
      topKeywords: [
        { text: "Error", value: 1 }
      ]
    };
  }
}

/**
 * Analyzes the sentiment and tone of a document
 */
async function generateSentimentAnalysis(text: string): Promise<any> {
  const prompt = `
    Perform sentiment analysis on this document. 
    For a CV/resume, professional tone, confidence, clarity, and achievement-focused language are considered positive.
    Vague descriptions, passive voice, and lack of specific achievements are considered negative.
    
    Provide:
    1. An overall sentiment score from 0 to 1 (where 1 is extremely positive)
    2. Sentiment scores for each major section of the document
    
    Respond with only valid JSON in this exact format:
    {
      "overallScore": number,
      "sentimentBySection": [
        {"section": "section_name", "score": number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing sentiment analysis:', error);
    return {
      overallScore: 0.5,
      sentimentBySection: [
        { section: "Document", score: 0.5 }
      ]
    };
  }
}

/**
 * Extracts key information elements from a document
 */
async function extractKeyInformation(text: string): Promise<any> {
  const prompt = `
    Extract the following key information from this document (likely a CV/resume):
    1. Contact information (email, phone, location)
    2. Key dates (employment periods, education completion)
    3. Named entities (organizations, skills, locations, degrees)
    
    Respond with only valid JSON in this exact format:
    {
      "contactInfo": [
        {"type": "type_name", "value": "extracted_value"}
      ],
      "keyDates": [
        {"description": "description", "date": "date_value"}
      ],
      "entities": [
        {"type": "entity_type", "name": "entity_name", "occurrences": number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing key information extraction:', error);
    return {
      contactInfo: [],
      keyDates: [],
      entities: []
    };
  }
}

/**
 * Generates a summary of the document with highlights and suggestions
 */
async function generateSummary(text: string): Promise<any> {
  const prompt = `
    Provide a comprehensive summary of this document (likely a CV/resume):
    1. 4-5 key highlights - the strongest points of the document
    2. 4-5 improvement suggestions - specific ways the document could be improved
    3. An overall score from 0-100 based on clarity, completeness, impact, and relevance
    
    Respond with only valid JSON in this exact format:
    {
      "highlights": ["highlight1", "highlight2", ...],
      "suggestions": ["suggestion1", "suggestion2", ...],
      "overallScore": number
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing summary generation:', error);
    return {
      highlights: ["Error generating highlights"],
      suggestions: ["Error generating suggestions"],
      overallScore: 50
    };
  }
} 